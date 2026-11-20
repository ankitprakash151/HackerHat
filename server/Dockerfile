FROM node:20-alpine

# Install Semgrep, Gitleaks, and Docker CLI inside container
RUN apk add --no-cache \
    python3 \
    py3-pip \
    git \
    curl \
    docker-cli

# Install semgrep via pip
RUN pip3 install --no-cache-dir --break-system-packages semgrep

# Install Gitleaks binary
RUN curl -sSL https://github.com/gitleaks/gitleaks/releases/download/v8.18.2/gitleaks_8.18.2_linux_x64.tar.gz | tar -xz -C /usr/local/bin gitleaks

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p temp_uploads reports_storage

EXPOSE 5000

CMD ["node", "src/index.js"]
