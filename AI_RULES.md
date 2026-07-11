# AI Rules & Guidelines

## Tech Stack
- **React 18**: Frontend library for building the user interface.
- **TypeScript**: Strongly typed programming language that builds on JavaScript for type safety.
- **Vite**: Fast build tool and development server.
- **Supabase JS Client (`@supabase/supabase-js`)**: Backend-as-a-Service for database storage, real-time subscriptions, and edge functions.
- **Recharts**: Charting library for rendering interactive charts (Bar, Line, Pie charts).
- **Custom CSS (`src/afftrack.css`)**: Styling is handled via custom CSS variables and classes, optimized for a mobile-first PWA layout (max-width: 430px).
- **Service Worker & PWA**: Progressive Web App capabilities with offline support and OneSignal push notifications.

---

## Library & Architecture Rules

### 1. Database & Realtime
- **Rule**: Use `@supabase/supabase-js` for all database queries, real-time subscriptions, and edge function calls.
- **Client**: Always import the configured client from `src/lib/supabase.ts`.
- **No Alternatives**: Do not introduce other database clients or ORMs.

### 2. State Management
- **Rule**: Use React's built-in hooks (`useState`, `useEffect`, `useCallback`, `useRef`) for local and global state.
- **Simplicity**: Keep state management simple and close to where it is used. Do not install Redux, Zustand, or other state management libraries.

### 3. Charts & Analytics
- **Rule**: Use `recharts` for all data visualizations (e.g., click trends, platform distribution).
- **Consistency**: Match the existing dark-themed color palette using the CSS variables or hex codes defined in `src/afftrack-app.tsx`.

### 4. Styling & Layout
- **Rule**: Use the existing custom CSS classes and CSS variables defined in `src/afftrack.css`.
- **Mobile-First**: Maintain the mobile-first, dark-themed, app-like layout (max-width: 430px) designed for mobile devices.
- **No Tailwind**: Do not install Tailwind CSS, shadcn/ui, or other CSS frameworks unless explicitly requested. Stick to the custom CSS system.

### 5. Icons & Visuals
- **Rule**: Use standard emojis or simple SVG icons to match the existing design language.
- **Consistency**: Keep the UI clean, modern, and consistent with the current dark-mode aesthetic.

### 6. PWA & Service Worker
- **Rule**: Keep the service worker (`public/sw.js`) and OneSignal integration intact.
- **Push Notifications**: Any push notification logic should interact with OneSignal.
