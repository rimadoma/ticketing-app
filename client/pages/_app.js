// Global CSS imported here is applied to every page
import 'bootstrap/dist/css/bootstrap.css'
import buildClient from '../api/build-client'
import Header from '../components/header';

// Next.js calls this with the current page component and its props.
// It's the root wrapper for every page in the app.
const AppComponent = ({ Component, pageProps, currentUser }) => {
    return (
        <div>
            <Header currentUser={currentUser} />
            <Component {...pageProps} />
        </div>
    );
};

// Stops page components' getInitialProps from being called by default -- thus calling them explicitly (if available)
AppComponent.getInitialProps = async appContext => {
    const client = buildClient(appContext.ctx);

    try {
        const { data } = await client.get(`/api/users/currentuser`);

        let pageProps = {};
        if (appContext.Component.getInitialProps) {
            // Invoke current page's getInitialProps
            pageProps = await appContext.Component.getInitialProps(appContext.ctx);
        }

        // ...data twice: top-level props go to AppComponent (e.g. Header), pageProps go to the page component
        return { pageProps: { ...pageProps, ...data }, ...data };
    } catch (err) {
        return { pageProps: { currentUser: null }, currentUser: null };
    }
};

export default AppComponent;