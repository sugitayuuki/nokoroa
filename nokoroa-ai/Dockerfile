FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# root 実行を避ける。ECS タスクが侵害された際の影響範囲を絞る。
# アプリは /app へ書き込まないため chown は不要。
# --system は付けない: UID < SYS_UID_MAX(999) を前提とするため、ホスト側の
# UID と衝突しにくい高い UID を明示する方針と噛み合わず警告が出る。
RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
