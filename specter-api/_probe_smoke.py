"""One-shot pipeline smoke test: enqueue a single probe job for a public store
and let the workers scrape it. Verification only — single request."""
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

from redis import Redis
from queue_client import enqueue_probe_job

url = "https://www.allbirds.com/products/mens-wool-runner-go"
domain = "www.allbirds.com"
url_path = "/products/mens-wool-runner-go"

client = Redis.from_url(os.environ["UPSTASH_REDIS_URL"])
job_id = enqueue_probe_job(
    client,
    url=url,
    domain=domain,
    url_path=url_path,
    competitor_tracking_ids=[str(uuid.uuid4())],  # dummy — pipeline smoke only
    plan="recon",
)
print(f"enqueued probe job id={job_id} for {url}")
