# LLM Providers Module

## Purpose
Contains thin adapters that create chat models for supported LLM vendors.

## Responsibilities
- Validate provider configuration.
- Translate `ModelSpec` into provider SDK model instances.
- Raise a common `ProviderUnavailable` error for fallback routing.

## Key Files
- `base.py`: provider interface and shared error.
- `google.py`, `openai.py`, `anthropic.py`, `openrouter.py`: vendor adapters.

## Boundaries
Adapters create models only. Selection, fallback, entitlements, and usage accounting belong in the parent `llm/` module.

## Testing
Mock SDK constructors and configuration; cover missing keys, model options, retry settings, and common failure translation.

## Latest Change
- Connected all provider adapters to the shared gateway used by queued and direct agent execution.
