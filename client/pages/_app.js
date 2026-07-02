// Global CSS imported here is applied to every page
import 'bootstrap/dist/css/bootstrap.css'
import buildClient from '../api/build-client'
import Header from '../components/header';

// Next.js calls this implicitly with the current page component and its props.
// It's the root wrapper for every page in the app.
const AppComponent = ({ Component, pageProps, currentUser }) => {
    return (
        <div>
            <Header currentUser={currentUser} />
            <div className="container">
                <Component currentUser={currentUser} {...pageProps} />
            </div>
        </div>
    );
};

// Stops page components' getInitialProps from being called by default -- thus calling them explicitly (if available)
AppComponent.getInitialProps = async appContext => {
    const client = buildClient(appContext.ctx);

    // Default to null if there's no authenticated user -- not all pages need authentication
    let data = { currentUser: null };
    try {
        ({ data } = await client.get(`/api/users/currentuser`));
    } catch (err) {}

    let pageProps = {};
    if (appContext.Component.getInitialProps) {
        // Invoke current page's getInitialProps
        pageProps = await appContext.Component.getInitialProps(appContext.ctx, client, data.currentUser);
    }

    return { pageProps, ...data };
};

export default AppComponent;