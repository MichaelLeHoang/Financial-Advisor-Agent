from src.agent import activity as activity_module
from src.agent.activity import (
    ActivityEventCollector,
    sanitize_error,
    sanitize_source,
    sanitize_tool_input,
)


def test_tool_activity_redacts_unknown_and_sensitive_inputs():
    safe = sanitize_tool_input(
        "search_financial_news",
        {
            "ticker": "NVDA",
            "query": "recent earnings",
            "limit": 10,
            "api_key": "should-not-leak",
            "authorization": "Bearer should-not-leak",
            "internal_prompt": "hidden instructions",
            "unrecognized": "private implementation detail",
        },
    )

    assert safe == {"ticker": "NVDA", "query": "recent earnings", "limit": 10}


def test_source_activity_only_keeps_safe_urls_and_compact_evidence():
    source = sanitize_source(
        {
            "title": "NVIDIA earnings release",
            "provider": "Investor Relations",
            "url": "https://investor.nvidia.com/results",
            "preview": "  Revenue grew strongly.  ",
        }
    )
    unsafe = sanitize_source(
        {"title": "Local file", "provider": "Unknown", "url": "file:///tmp/private"}
    )

    assert source is not None
    assert source.url == "https://investor.nvidia.com/results"
    assert source.preview == "Revenue grew strongly."
    assert unsafe is not None
    assert unsafe.url is None


def test_activity_collector_builds_tool_and_source_trace_without_raw_reasoning():
    collector = ActivityEventCollector("run-1", "single")

    started = collector.consume(
        {
            "active_tool": "search_financial_news",
            "active_label": "Reviewing recent news",
            "message": "Searching trusted market sources.",
            "completed_tools": [],
            "tool_input": {"ticker": "NVDA", "api_key": "secret"},
            "sources": [
                {
                    "title": "NVIDIA results",
                    "provider": "Investor Relations",
                    "url": "https://investor.nvidia.com/results",
                }
            ],
        }
    )
    completed = collector.consume(
        {
            "active_tool": None,
            "completed_tools": ["search_financial_news"],
            "message": "Recent evidence reviewed.",
            "tool_output": {"articles": 8, "system_prompt": "must not appear"},
        }
    )
    trace = collector.trace()

    assert [event.type for event in started] == [
        "step.started",
        "tool.started",
        "source.found",
    ]
    assert [event.type for event in completed] == ["step.completed", "tool.completed"]
    assert trace.status == "completed"
    assert trace.tools[0].tool_input == {"ticker": "NVDA"}
    assert trace.tools[0].output_summary == "articles: 8"
    assert trace.sources[0].provider == "Investor Relations"


def test_activity_error_redacts_long_credentials():
    error = sanitize_error("Provider rejected Bearer abcdefghijklmnopqrstuvwxyz123456")

    assert "abcdefghijklmnopqrstuvwxyz" not in error.message
    assert "[redacted]" in error.message


def test_activity_collector_marks_completed_fallbacks_as_warnings():
    collector = ActivityEventCollector("run-2", "consensus")
    collector.consume(
        {
            "active_tool": "risk_analyst",
            "completed_tools": [],
            "active_label": "Risk Analyst",
            "message": "Risk Analyst is working...",
        }
    )

    events = collector.consume(
        {
            "active_tool": None,
            "completed_tools": ["risk_analyst"],
            "active_label": "Risk Analyst",
            "message": "Risk Analyst completed with fallback analysis.",
            "tool_warning": "Provider timed out",
        }
    )

    assert events[0].type == "step.completed"
    assert events[0].status == "warning"
    assert events[0].error.message == "Provider timed out"


def test_activity_collector_records_safe_detail_and_step_duration(monkeypatch):
    clock = iter([10.0, 12.345])
    monkeypatch.setattr(activity_module.time, "monotonic", lambda: next(clock))
    collector = ActivityEventCollector("run-duration", "consensus")

    started = collector.consume(
        {
            "active_tool": "risk_analyst",
            "completed_tools": [],
            "active_label": "Risk Analyst",
            "message": "Risk Analyst is working...",
            "activity_detail": "Calculating volatility, drawdown, VaR, and downside flags.",
        }
    )
    completed = collector.consume(
        {
            "active_tool": None,
            "completed_tools": ["risk_analyst"],
            "active_label": "Risk Analyst",
            "message": "Risk Analyst completed analysis.",
            "activity_detail": "Returned a neutral view at 72% confidence and flagged 2 risks.",
        }
    )

    assert started[0].description == (
        "Calculating volatility, drawdown, VaR, and downside flags."
    )
    assert completed[0].description == (
        "Returned a neutral view at 72% confidence and flagged 2 risks."
    )
    assert completed[0].duration_ms == 2345
