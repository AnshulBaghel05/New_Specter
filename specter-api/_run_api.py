"""Local-preview launcher: load .env into the process env, then run uvicorn.
The app reads os.environ directly (db.py), so .env must be loaded before import."""
from dotenv import load_dotenv

load_dotenv()

import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, log_level="info")
