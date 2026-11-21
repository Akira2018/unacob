import React from 'react';
import { parseMoedaBR, formatMoedaBR } from '../utils/formatters';

/**
 * Campo padronizado de entrada de moeda brasileira (R$).
 * - Máscara monetária em tempo real com prefixo "R$"
 * - Aceita digitação com vírgula ou converte ponto para vírgula automaticamente
 * - Limita a 2 casas decimais
 * - Formata no padrão brasileiro com 2 casas no blur (ex: 35 -> 35,00)
 * - Seleciona todo o conteúdo ao focar para facilitar reedição
 */
export default function MoedaInput({
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder = '0,00',
  required = false,
  disabled = false,
  readOnly = false,
  className = '',
  style = {},
  inputStyle = {},
  showHelpText = true,
  helpText = 'Duas casas decimais separadas por vírgula (ex.: 35,00 ou 35,50).',
  allowNegative = false,
  name,
  id,
  ...rest
}) {
  const handleChange = (e) => {
    let val = e.target.value;
    if (!val || val.trim() === '') {
      if (onChange) onChange({ target: { value: '', name } });
      return;
    }

    // Converte '.' em ',' automaticamente
    val = val.replace(/\./g, ',');

    // Permite apenas dígitos, vírgula e opcionalmente sinal negativo no início
    if (allowNegative) {
      const isNegative = val.startsWith('-');
      val = val.replace(/[^0-9,]/g, '');
      if (isNegative) val = '-' + val;
    } else {
      val = val.replace(/[^0-9,]/g, '');
    }

    // Permite no máximo uma vírgula
    const parts = val.split(',');
    if (parts.length > 2) {
      val = parts[0] + ',' + parts.slice(1).join('');
    }

    // Permite no máximo 2 casas decimais após a vírgula
    if (parts.length === 2 && parts[1].length > 2) {
      val = parts[0] + ',' + parts[1].slice(0, 2);
    }

    if (onChange) onChange({ target: { value: val, name } });
  };

  const handleBlur = (e) => {
    if (value !== '' && value !== null && value !== undefined && String(value).trim() !== '') {
      const num = parseMoedaBR(value);
      if (onChange) onChange({ target: { value: formatMoedaBR(num), name } });
    }
    if (onBlur) onBlur(e);
  };

  const handleFocus = (e) => {
    e.target.select();
    if (onFocus) onFocus(e);
  };

  const displayValue = typeof value === 'number'
    ? formatMoedaBR(value)
    : (value ?? '');

  return (
    <div style={{ width: '100%', ...style }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        <span style={{
          position: 'absolute',
          left: 10,
          color: '#666',
          fontWeight: 600,
          fontSize: 14,
          pointerEvents: 'none',
          userSelect: 'none'
        }}>
          R$
        </span>
        <input
          type="text"
          inputMode="decimal"
          name={name}
          id={id}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          className={className}
          style={{ paddingLeft: 36, fontWeight: 600, width: '100%', ...inputStyle }}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          {...rest}
        />
      </div>
      {showHelpText && helpText ? (
        <small style={{ display: 'block', color: '#666', marginTop: 4 }}>
          {helpText}
        </small>
      ) : null}
    </div>
  );
}
