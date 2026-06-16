"""
Standalone worker process — separate from the API process.
Run with: python worker.py
"""
import asyncio
import json

from app.infra.redis_client import get_redis, RESEARCH_QUEUE_KEY
from app.workflows.research_graph import research_graph


async def process_job(job_data: dict) -> None:
    print(f"[worker] Picked up job {job_data['job_id']}")

    result = research_graph.invoke({
        "topic": job_data["topic"],
        "objective": job_data["objective"],
        "result": "",
    })

    print(f"[worker] Job {job_data['job_id']} done.")
    print(f"[worker] Result:\n{result['result']}\n")


async def main() -> None:
    redis_conn = get_redis()
    print("[worker] Listening on 'research_jobs'...")

    while True:
        # BRPOP blocks until a job exists — no polling
        _, raw_job = await redis_conn.brpop(RESEARCH_QUEUE_KEY)
        job_data = json.loads(raw_job)

        try:
            await process_job(job_data)
        except Exception as e:
            print(f"[worker] Job {job_data.get('job_id')} failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())