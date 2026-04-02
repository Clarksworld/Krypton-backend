import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: "app/api", // Path to your API routes
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Krypton Backend API",
        version: "1.0.0",
        description: "Official API documentation for the Krypton Crypto Platform.",
      },
      servers: [
        {
          url: "https://krypton-backend-ten.vercel.app",
          description: "Production Server",
        },
        {
          url: process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
          description: "Development/Preview Server",
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [],
    },
  });
  return spec;
};
