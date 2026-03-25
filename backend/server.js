const { app } = require("./src/app");

const port = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend API listening on port ${port}`);
  });
}

module.exports = app;
