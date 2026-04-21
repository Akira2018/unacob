import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function DocumentationBreadcrumbs({ items }) {
  return (
    <nav className="documentation-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <Fragment key={`${item.label}-${index}`}>
            {item.to && !isLast ? (
              <Link to={item.to} className="documentation-breadcrumb-link">
                {item.label}
              </Link>
            ) : (
              <span className="documentation-breadcrumb-current">{item.label}</span>
            )}

            {!isLast ? <ChevronRight size={14} className="documentation-breadcrumb-separator" /> : null}
          </Fragment>
        );
      })}
    </nav>
  );
}