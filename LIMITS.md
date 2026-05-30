# Usage Limits

This document tracks all rate limits and usage caps in the app. These will be used as the basis for future pricing tiers (free vs paid plans).

## AI Features

| Feature | Limit | Window | Enforcement |
|---------|-------|--------|-------------|
| Photo scan (GPT-4o) | 20 requests | per hour | `express-rate-limit` per user |
| AI suggestion | 20 requests | per hour | `express-rate-limit` per user |
| Nutrition analysis | 10 requests | per day | `express-rate-limit` per user |
| Voice input (Whisper + GPT) | 180 seconds (3 min) | per day | DB tracking on User model, resets daily |

## Voice Input Details

- **Daily limit:** 180 seconds total recording time per user per day
- **Per-recording cap:** 60 seconds max per single recording
- **Tracking:** `voice_seconds_used` and `voice_seconds_reset_at` columns on `users` table
- **Reset:** Automatic on first request of the new day
- **Backend cost:** ~$0.006/min Whisper transcription + ~$0.001 GPT-4o-mini analysis per request

## File Uploads

| Type | Max size | Formats |
|------|----------|---------|
| Meal photo | 10 MB | JPEG, PNG, WebP |
| Story video | 50 MB | MP4, MOV, WebM |
| Voice audio | 10 MB | WebM, OGG, MP4, MPEG, WAV, M4A |
| Avatar | 10 MB | JPEG, PNG, WebP |

## Auth

| Limit | Value |
|-------|-------|
| Access token expiry | 15 min (default) |
| Refresh token expiry | 7 days (default) |

## Future Pricing Considerations

When implementing paid tiers, consider upgrading these limits:
- **Free:** Current limits (20 scans/hr, 3 min voice/day)
- **Pro:** Higher AI limits (100 scans/hr, 15 min voice/day, unlimited suggestions)
- **Premium:** Unlimited AI usage, priority processing
