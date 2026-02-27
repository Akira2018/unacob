from datetime import datetime
import uuid

import models
from auth import get_password_hash
from database import SessionLocal


def reset_admin(email: str = "admin@associacao.com", password: str = "admin123") -> None:
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.email == email).first()
        if admin:
            admin.password = get_password_hash(password)
            admin.ativo = True
            if not admin.role:
                admin.role = "administrador"
            if not admin.nome_completo:
                admin.nome_completo = "Administrador"
            db.commit()
            print(f"Senha do usuário {email} redefinida com sucesso.")
            return

        admin = models.User(
            id=str(uuid.uuid4()),
            email=email,
            nome_completo="Administrador",
            role="administrador",
            password=get_password_hash(password),
            ativo=True,
            created_at=datetime.utcnow(),
        )
        db.add(admin)
        db.commit()
        print(f"Usuário {email} criado com sucesso.")
    finally:
        db.close()


if __name__ == "__main__":
    reset_admin()
