export function getApiErrorMessage(error, fallbackMessage = 'Erro na requisição') {
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === 'string' && first.trim()) {
      return first;
    }
    if (first?.msg) {
      return first.msg;
    }
  }

  const message = error?.response?.data?.message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return fallbackMessage;
}

export function getPublicApiErrorMessage(responseData, fallbackMessage = 'Erro na requisição') {
  return getApiErrorMessage({ response: { data: responseData } }, fallbackMessage);
}
