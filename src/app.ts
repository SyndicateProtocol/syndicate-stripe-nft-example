import './env';
import express from 'express';
import routes from './routes';

const app = express();

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/webhook')) {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

app.use(routes);

app.listen(4242, () => {
  console.log(`Server is running on ${process.env.YOUR_DOMAIN}`);
});
