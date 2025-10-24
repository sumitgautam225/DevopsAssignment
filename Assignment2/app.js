const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello. This is simple get request  with express ');
});
app.get('/greet', (req, res) => {
    res.send(`
        <div style="
            padding: 30px;
            background-color: #f0fff4; /* A light mint color */
            border-radius: 12px;
            text-align: center;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            max-width: 400px;
            margin: 50px auto;
        ">
            <h1 style="color: #28a745; margin-bottom: 10px;">👋 Service Online!</h1>
            <p style="color: #343a40; font-size: 1.1em;">
                The **Greeting Endpoint** is actively serving requests.
            </p>
            <small style="color: #6c757d;">(Status: 200 OK)</small>
        </div>
    `)
})
app.listen(port, () => {
  console.log(`App running on http://localhost:${port}`);
});
