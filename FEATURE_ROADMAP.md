# Selected Feature Roadmap

Last updated: 2026-04-26

This file records the feature scope selected by the user so future implementation batches stay aligned.

## Batch 3: Data Quality

- Normalized contact parser: clean and standardize phone, email, and bio link values from scraped text and AI output.

## Batch 4: Lead Scoring + Priority Views

- Priority views: split extracted profiles into practical review groups such as hot leads, missing contact, and low quality.
- Saved filters/views: let the user reuse common filters without rebuilding them each session.

## Batch 5: Change Detection + Watchlist

- Change detection: compare refreshed data against older profile data and surface what changed.
- Watchlist: mark strategic profiles for repeated review and refresh.

## Batch 6: Reporting / KPI Dashboard

- Daily scrape dashboard: show daily volume, success, failure, and usable profile output.
- Source performance: compare platform and mode performance, such as TikTok vs Facebook and fast vs full mode.
- Field completion report: show completion rates for fields like phone, email, bio link, followers, and engagement metrics.

## Batch 7: CRM Workflow

- Bulk status workflow: move profiles through workflow states such as New, Reviewed, Shortlisted, Contacted, Negotiating, and Closed.
- Notes templates: add reusable note patterns for common scouting and outreach observations.

## Batch 9: Dedup + Classification

- Duplicate identity resolver: detect duplicated creator/page records from variant links or repeated imports.
- Profile classification: classify profiles by niche, profile type, and likely audience fit.

## Batch 10: Intake UX

- Browser extension / bookmarklet: add profiles into Scout Hub directly while browsing TikTok or Facebook.

## Selected AI / Outreach Enhancements

The user selected these enhancement directions for the next product expansion:

- Auto workflow routing: move profiles through outreach-ready states based on contact quality, fit, and next best action.
- AI content generation: draft quote-request emails, collaboration invitations, DM scripts, follow-ups, negotiation replies, and creator briefs.
- Email outreach engine: prepare, approve, send, and track creator outreach messages from the CRM.
- Quote and rate management: parse quote replies, update rate history, compare SOW pricing, and flag negotiation opportunities.
- AI assistant inside CRM: let the user ask questions across selected profiles and trigger actions such as status updates, draft creation, campaign assignment, and exports.

## AI Provider Direction

- Prefer a free-first / low-cost architecture with BYOK keys instead of locking the app to one model provider.
- Add a provider adapter layer so the app can call OpenAI-compatible APIs from providers such as OpenRouter, Groq, DeepSeek, Alibaba Cloud Model Studio / Qwen, Z.AI / GLM, and Moonshot / Kimi.
- Use cheap/free models for repetitive structured tasks such as classification, routing, draft generation, and quote parsing.
- Keep a stronger fallback model option for higher-risk tasks such as bulk campaign recommendations, brand-safety review, and multi-profile reasoning.
- Add model cost controls: per-run token estimate, daily cap, provider fallback order, retry/cooldown, and prompt/result logging for QA.

## Candidate Enhancement Rooms

- Campaign brief workspace: store campaign objective, product, audience, SOW, budget range, tone, region, must-have, and must-avoid rules.
- Lead fit score: calculate fit from niche, audience hint, tier, engagement, contact readiness, brand-safety risk, and campaign match.
- Outreach approval queue: generate drafts in bulk but require human approval before sending.
- Outreach history timeline: store every draft, sent message, follow-up, reply, quote, and negotiation note per profile.
- Reply parser: paste or sync creator replies and let AI extract price, SOW, availability, timeline, deliverables, and concerns.
- Rate benchmark view: compare quote against profile tier, followers, average view, engagement, past rates, and campaign budget.
- Saved outreach templates: reusable prompt/template sets for quote request, collab invite, follow-up, negotiation, and rejection.
- KPI dashboard: track profiles scraped, qualified leads, contactable rate, outreach sent, reply rate, quote rate, average quote, and time from scrape to outreach-ready.
- QA and compliance guardrails: detect missing contact consent, duplicate sends, risky wording, over-claiming, and spam-like bulk behavior.
- Model routing settings: choose default model per task and support fallback from free model to paid/stronger model when needed.
