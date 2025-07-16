export const userInfoQuery = `
  query {
    viewer {
      login
      id
    }
  }
`;

export const createContributedRepoQuery = (username: string, privacy: 'PUBLIC' | 'PRIVATE') => `
  query {
    user(login: "${username}") {
      repositoriesContributedTo(
        last: 100,
        includeUserRepositories: true,
        privacy: ${privacy}
      ) {
        nodes {
          isFork
          name
          owner {
            login
          }
        }
      }
    }
  }
`;

export const createOwnRepoQuery = (username: string) => `
  query {
    user(login: "${username}") {
      repositories(
        first: 100,
        privacy: PRIVATE,
        ownerAffiliations: OWNER
      ) {
        nodes {
          isFork
          name
          owner {
            login
          }
        }
      }
    }
  }
`;

export const createCommittedDateQuery = (id: string, name: string, owner: string) => `
  query {
    repository(owner: "${owner}", name: "${name}") {
      ref(qualifiedName: "master") {
        target {
          ... on Commit {
            history(first: 100, author: { id: "${id}" }) {
              edges {
                node {
                  committedDate
                }
              }
            }
          }
        }
      }
    }
  }
`;
