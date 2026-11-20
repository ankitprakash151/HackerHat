FROM zaproxy/zap-baseline:stable

# Harden ZAP runner image with non-root security context
USER zap

WORKDIR /zap/wrk

ENTRYPOINT ["zap-baseline.py"]
