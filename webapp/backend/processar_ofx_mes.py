from database import SessionLocal
import models
import main


def executar(mes_referencia: str):
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.role == "administrador").order_by(models.User.created_at.asc()).first()
        if not user:
            raise RuntimeError("Administrador não encontrado")
        resultado = main.processar_conciliacao_ofx_mes(mes_referencia, db=db, current_user=user)
        print(resultado)
    finally:
        db.close()


if __name__ == "__main__":
    executar("2026-02")
