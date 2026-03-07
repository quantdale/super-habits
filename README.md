# SuperHabits MVP

Offline-first cross-platform productivity app built with Expo, React Native, and web/PWA support.

## Included MVP Modules

- To-do list
- Habit tracking
- Pomodoro timer
- Workout routines/checklist
- Calorie counter

## Scripts

- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run typecheck`
- `npm run test`

## Architecture

- Feature modules in `features/*`
- Shared infra in `core/*`
- Routes in `app/*`
- Guest-first local profile with on-device persistence
- Local-first SQLite data layer with future-ready sync contracts

## Manual Smoke Test Checklist

1. Launch app in web and native emulator.
2. Create, toggle, and delete a to-do.
3. Create a habit and mark completion.
4. Start/reset pomodoro and verify a session logs after completion.
5. Create routine and mark workout completion.
6. Add calorie entries and verify daily total.
7. Close and relaunch app; verify data persists.
