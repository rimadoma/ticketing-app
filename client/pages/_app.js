// Global CSS imported here is applied to every page
import 'bootstrap/dist/css/bootstrap.css'

// Next.js calls this with the current page component and its props.
// It's the root wrapper for every page in the app.
const App = ({ Component, pageProps }) => {
    return <Component {...pageProps}/>
};

export default App;