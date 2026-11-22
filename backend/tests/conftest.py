import os

# Point the app at a throwaway in-memory database *before* it is imported,
# so running the tests never touches the real local app.db.
os.environ["DATABASE_URL"] = "sqlite://"
