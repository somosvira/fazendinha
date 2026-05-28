import express from "express";
import cors from "cors";
import { exigirAuth } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { cadastrosRouter } from "./routes/cadastros.js";
import { lancamentosRouter } from "./routes/lancamentos.js";
import { relatoriosRouter } from "./routes/relatorios.js";
import { fechamentosRouter } from "./routes/fechamentos.js";

const app = express();
app.use(cors());
app.use(express.json());

// Públicas
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);

// Protegidas
app.use("/api/cadastros", exigirAuth, cadastrosRouter);
app.use("/api/lancamentos", exigirAuth, lancamentosRouter);
app.use("/api/relatorios", exigirAuth, relatoriosRouter);
app.use("/api/fechamentos", exigirAuth, fechamentosRouter);

const port = Number(process.env.PORT ?? 41873);
app.listen(port, () => {
  console.log(`API Rio Novo rodando em http://localhost:${port}`);
});
