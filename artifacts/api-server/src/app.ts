import express, { type Express } from "express";
import cors from "cors";
import passport from "passport";
import pinoHttp from "pino-http";
import { createSessionMiddleware } from "./middleware/session";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const allowedOrigins = [
  /\.replit\.dev$/,
  /\.replit\.app$/,
  /^http:\/\/localhost/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = allowedOrigins.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin)
      );
      callback(null, allowed);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(createSessionMiddleware());
app.use(passport.initialize());
app.use(passport.session());

app.use("/api", router);

export default app;
