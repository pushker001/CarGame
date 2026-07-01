FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy all project files
COPY . .

# Install dependencies for both client and server
RUN npm run postinstall

# Build the Vite frontend
RUN npm run build

# Hugging Face Spaces require apps to listen on port 7860
ENV PORT=7860
EXPOSE 7860

# Start the Node.js server
CMD ["npm", "start"]
