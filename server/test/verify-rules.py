import os
import re

target_dir = os.path.join(os.getcwd(), 'test-targets', 'vulnerable-app')
app_js_path = os.path.join(target_dir, 'app.js')
env_path = os.path.join(target_dir, '.env')

with open(app_js_path, 'r', encoding='utf-8') as f:
    app_js = f.read()

with open(env_path, 'r', encoding='utf-8') as f:
    env_file = f.read()

findings = []

# 1. Check MD5
if "createHash('md5')" in app_js:
    findings.append(('vibe-weak-password-hashing-md5', 'HIGH', 'Weak MD5 Password Hashing'))

# 2. Check plaintext password
if "user.password === req.body.password" in app_js:
    findings.append(('vibe-plaintext-password-compare', 'CRITICAL', 'Plaintext Password Comparison'))

# 3. Check missing auth on /api/admin/users
if "app.get('/api/admin/users" in app_js and 'authenticate' not in app_js:
    findings.append(('vibe-missing-auth-middleware-admin', 'HIGH', 'Missing Auth Middleware on /api/admin/users'))

# 4. Check algorithm 'none'
if "algorithm: 'none'" in app_js:
    findings.append(('vibe-weak-jwt-none-algorithm', 'CRITICAL', 'Insecure JWT none Algorithm'))

# 5. Check hardcoded JWT secret
if "'secret'" in app_js:
    findings.append(('vibe-hardcoded-jwt-secret', 'HIGH', 'Hardcoded JWT Secret in Code'))

# 6. Check res.json(process.env)
if "res.json(process.env)" in app_js:
    findings.append(('vibe-exposed-env-dump-route', 'CRITICAL', 'Exposed Environment Variables in API'))

# 7. Check OpenAI API Key
if re.search(r'sk-proj-[a-zA-Z0-9\-_]{30,}', env_file):
    findings.append(('openai-api-key', 'CRITICAL', 'Hardcoded OpenAI API Key in .env'))

# 8. Check Mongo URI with credentials
if re.search(r'mongodb\+srv:\/\/[^:]+:[^@]+@', env_file):
    findings.append(('mongodb-connection-uri', 'CRITICAL', 'MongoDB Credentials in .env'))

print(f'Detected {len(findings)} findings in vulnerable target:')
for f in findings:
    print(f'  - [{f[1]}] {f[2]} ({f[0]})')

score = 100
for f in findings:
    if f[1] == 'CRITICAL': score -= 20
    elif f[1] == 'HIGH': score -= 20
    elif f[1] == 'MEDIUM': score -= 10
    elif f[1] == 'LOW': score -= 5
score = max(0, score)
grade = 'F' if score < 50 else 'C' if score < 70 else 'B' if score < 85 else 'A'
print(f'\nFinal Calculated Security Score: {score}/100 (Grade: {grade})')
assert score == 0, 'Multiple critical findings should reduce score to floor 0'
print('Rule validation logic successfully verified!')
