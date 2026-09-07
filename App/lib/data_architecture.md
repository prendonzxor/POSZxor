# Data Architecture (Local + API)

This app now supports two data modes:

- `local`: Uses local/in-memory data sources (fast/offline-friendly for development).
- `api`: Uses remote API data sources (production integration).

## Switch mode

Use dart-define:

- Local mode (default):
  - `flutter run`
- API mode:
  - `flutter run --dart-define=POS_DATA_MODE=api --dart-define=POS_API_BASE_URL=http://localhost:3010`

## Folder structure

- `core/config/data_mode.dart`
  - Mode and API base URL configuration.
- `features/<feature>/domain/`
  - Feature entities/models.
- `features/<feature>/data/`
  - `*_data_source.dart` (contract)
  - `*_local_data_source.dart` (local implementation)
  - `*_api_data_source.dart` (remote implementation)
  - `*_repository.dart` (mode switch + fallback)

## Current implementation

- Implemented for Dashboard:
  - Local: mock metrics
  - API: calls `/api/analytics/overview?days=7`
  - Repository fallback: if API fails, fallback to local
