import buildClient from '../api/build-client'

const LandingPage = ({ currentUser }) => {
    if (currentUser) {
        return <h1>You're signed in</h1>;
    }

   return <h1>You're NOT signed in</h1>;
};

LandingPage.getInitialProps = async context => {
    const client = buildClient(context);

    try {
        const { data } = await client.get(`/api/users/currentuser`);
        return data;
    } catch (err) {
        return { currentUser: null };
    }
};

export default LandingPage;