export default function TableEmptyRow({ colSpan, message, className = 'table-empty-message', style }) {
  return (
    <tr>
      <td colSpan={colSpan} className={className} style={style}>
        {message}
      </td>
    </tr>
  );
}