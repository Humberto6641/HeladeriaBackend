require("dotenv").config();

const cors = require('cors');
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const rutas = require("./rutas"); 

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const app = express();
app.use(cors({
  origin: 'https://heladoshumberto.netlify.app'  
}));
app.use(express.json()); 

const PORT = process.env.PORT || 3000;

app.use("/api", rutas); 

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});