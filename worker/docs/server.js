const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Read and parse the YAML file
const swaggerDocument = YAML.parse(
  fs.readFileSync(path.join(__dirname, '../swagger.yaml'), 'utf8')
);

// Serve Swagger UI at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Redirect root to docs
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

app.listen(port, () => {
  console.log(`Swagger UI is running at http://localhost:${port}/api-docs`);
}); 