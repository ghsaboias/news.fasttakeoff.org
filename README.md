# News AI World

A web application for managing and analyzing news content.

## Project Structure

- `frontend/`: React + TypeScript frontend using Vite
- `backend/`: Python FastAPI backend

## Setup & Running

### Backend

1. Create and activate a Python virtual environment:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r ../requirements.txt
```

3. Run the backend server:

```bash
uvicorn main:app --reload
```

The backend will be available at http://localhost:8000

### Frontend

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start the development server:

```bash
npm run dev
```

The frontend will be available at http://localhost:5173

## Development

- Frontend development server: `npm run dev`
- Build frontend: `npm run build`
- Lint frontend: `npm run lint`
- Preview frontend build: `npm run preview`
