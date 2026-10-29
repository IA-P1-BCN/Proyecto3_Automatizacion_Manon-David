FROM python:3.13.7-slim
ARG BRIDGE_UID=10001
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN test "$BRIDGE_UID" -gt 0 \
    && groupadd --gid 10001 bridge \
    && useradd --uid "$BRIDGE_UID" --gid 10001 --no-create-home bridge \
    && mkdir -p /state /run/secrets && chown "$BRIDGE_UID":10001 /state
WORKDIR /app
COPY bridge.py /app/bridge.py
USER ${BRIDGE_UID}:10001
ENTRYPOINT ["python", "/app/bridge.py"]
