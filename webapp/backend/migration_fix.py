#!/usr/bin/env python
"""Script para migrar o banco de dados com a nova coluna pagamento_id"""

import sqlite3
from pathlib import Path

db_path = Path(__file__).parent / "associacao.db"

try:
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Check if pagamento_id column exists
    cursor.execute("PRAGMA table_info(conciliacoes)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'pagamento_id' not in columns:
        print("Adicionando coluna pagamento_id...")
        cursor.execute("""
            ALTER TABLE conciliacoes 
            ADD COLUMN pagamento_id VARCHAR(36)
        """)
        conn.commit()
        print("✓ Coluna pagamento_id adicionada")
    else:
        print("✓ Coluna pagamento_id já existe")
    
    # Check for other missing columns
    required_columns = {
        'banco': 'VARCHAR(100)',
        'numero_documento': 'VARCHAR(100)'
    }
    
    for col_name, col_type in required_columns.items():
        if col_name not in columns:
            print(f"Adicionando coluna {col_name}...")
            cursor.execute(f"""
                ALTER TABLE conciliacoes 
                ADD COLUMN {col_name} {col_type}
            """)
            conn.commit()
            print(f"✓ Coluna {col_name} adicionada")
    
    # Remove old columns if they exist
    old_columns = ['transacao_id', 'diferenca']
    for col_name in old_columns:
        if col_name in columns:
            print(f"Removendo coluna {col_name}...")
            # SQLite doesn't support DROP COLUMN easily, so we recreate the table
            # For now, just note that these should be removed
            print(f"⚠ Coluna {col_name} ainda existe (não removida)")
    
    print("\nMigração concluída!")
    conn.close()
    
except Exception as e:
    print(f"Erro: {e}")
