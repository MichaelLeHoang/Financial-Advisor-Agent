from src.agent.llm_worker import LLMWorker


def main() -> None:
    print("Starting QuanAd LLM worker...")
    LLMWorker().run_forever()


if __name__ == "__main__":
    main()
