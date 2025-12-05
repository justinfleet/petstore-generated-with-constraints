FROM node:20-alpine

# Install pnpm 9.15.1
RUN npm install -g pnpm@9.15.1

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY server/package.json ./server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY server ./server
COPY data ./data

# Build the application
RUN pnpm --filter server build

# Expose port
EXPOSE 3002

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3002

# Start the application
CMD ["pnpm", "--filter", "server", "start"]