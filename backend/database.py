import os
import asyncpg
from datetime import datetime

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:EuZTb19VZKPwmLPN@db.dsrhrytbakxuqvjtjvgk.supabase.co:5432/postgres"
)


class Database:
    def __init__(self):
        self.pool: asyncpg.Pool = None

    async def connect(self):
        try:
            self.pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)
            print("✅ Database connected")
        except Exception as e:
            print(f"⚠️  Database connection failed: {e}")
            self.pool = None

    async def disconnect(self):
        if self.pool:
            await self.pool.close()

    async def create_tables(self):
        if not self.pool:
            return
        try:
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        created_at TIMESTAMP DEFAULT NOW(),
                        total_chats INTEGER DEFAULT 0
                    );
                    CREATE TABLE IF NOT EXISTS messages (
                        id SERIAL PRIMARY KEY,
                        sender_id TEXT,
                        receiver_id TEXT,
                        text TEXT,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                """)
            print("✅ Tables ready")
        except Exception as e:
            print(f"⚠️  Table creation failed: {e}")

    async def create_user(self, user_id: str):
        if not self.pool:
            return
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    "INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING",
                    user_id
                )
        except Exception as e:
            print(f"DB create_user error: {e}")

    async def save_message(self, sender_id: str, receiver_id: str, text: str):
        if not self.pool:
            return
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    "INSERT INTO messages (sender_id, receiver_id, text) VALUES ($1, $2, $3)",
                    sender_id, receiver_id, text
                )
        except Exception as e:
            print(f"DB save_message error: {e}")
