// import { getTranslations } from './getTranslations';

// export const withTranslations = (pageGetStaticProps) => async (ctx) => {
//     const translations = await getTranslations(ctx.locale);

//     const pageResult = pageGetStaticProps
//         ? await pageGetStaticProps(ctx)
//         : { props: {} };

//     return {
//         ...pageResult,
//         props: {
//             ...(pageResult.props || {}),
//             translations,
//         },
//     };
// };

// export const getStaticPropsOnlyTranslations = withTranslations();
