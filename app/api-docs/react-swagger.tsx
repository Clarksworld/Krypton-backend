'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import './swagger-custom.css'; // Optional: for custom overrides

type Props = {
  spec: Record<string, any>;
};

function ReactSwagger({ spec }: Props) {
  return (
    <div className="swagger-container">
      <SwaggerUI spec={spec} />
    </div>
  );
}

export default ReactSwagger;
