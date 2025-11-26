require("dotenv").config();
const connectDB = require("./utils/db");
const app = require("./app");

// connect to database
connectDB();

// start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`app listening at port ${PORT}`);
});
