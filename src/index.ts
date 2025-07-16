import { resolve } from 'path';
import { config } from 'dotenv';
import { Octokit } from '@octokit/rest';

import githubQuery from './githubQuery';
import generateBarChart from './generateBarChart';
import {
  userInfoQuery,
  createContributedRepoQuery,
  createOwnRepoQuery,
  createCommittedDateQuery
} from './queries';

config({ path: resolve(__dirname, '../.env') });

interface IRepo {
  name: string;
  owner: string;
}

(async () => {
  const userResponse = await githubQuery(userInfoQuery)
    .catch(error => console.error(`Unable to get username and id\n${error}`));
  const { login: username, id } = userResponse?.data?.viewer;

  // Fetch public + private contributed repos
  const [publicReposRes, privateReposRes, ownReposRes] = await Promise.all([
    githubQuery(createContributedRepoQuery(username, 'PUBLIC')),
    githubQuery(createContributedRepoQuery(username, 'PRIVATE')),
    githubQuery(createOwnRepoQuery(username)),
  ]).catch(error => console.error(`Error fetching repos: ${error}`));

  const extractRepos = (data: any) =>
    data?.nodes
      ?.filter((r: any) => !r?.isFork)
      .map((r: any) => ({ name: r.name, owner: r.owner.login })) || [];

  const allRepos: IRepo[] = [
    ...extractRepos(publicReposRes?.data?.user?.repositoriesContributedTo),
    ...extractRepos(privateReposRes?.data?.user?.repositoriesContributedTo),
    ...extractRepos(ownReposRes?.data?.user?.repositories),
  ];

  // Deduplicate repos
  const uniqueRepos = Array.from(new Map(
    allRepos.map(r => [`${r.owner}/${r.name}`, r])
  ).values());

  // Get commits
  const committedTimeResponseMap = await Promise.all(
    uniqueRepos.map(({ name, owner }) =>
      githubQuery(createCommittedDateQuery(id, name, owner))
    )
  ).catch(error => console.error(`Unable to get commit info\n${error}`));

  let morning = 0, daytime = 0, evening = 0, night = 0;

  committedTimeResponseMap.forEach(committedTimeResponse => {
    committedTimeResponse?.data?.repository?.ref?.target?.history?.edges.forEach(edge => {
      const committedDate = edge?.node?.committedDate;
      const timeString = new Date(committedDate).toLocaleTimeString('en-US', {
        hour12: false,
        timeZone: process.env.TIMEZONE,
      });
      const hour = +timeString.split(':')[0];
      if (hour >= 6 && hour < 12) morning++;
      else if (hour >= 12 && hour < 18) daytime++;
      else if (hour >= 18 && hour < 24) evening++;
      else night++;
    });
  });

  const sum = morning + daytime + evening + night;
  if (!sum) return;

  const oneDay = [
    { label: '🌞 Morning', commits: morning },
    { label: '🌆 Daytime', commits: daytime },
    { label: '🌃 Evening', commits: evening },
    { label: '🌙 Night', commits: night },
  ];

  const lines = oneDay.map(({ label, commits }) => {
    const percent = commits / sum * 100;
    return [
      `${label}`.padEnd(10),
      `${commits.toString().padStart(5)} commits`.padEnd(14),
      generateBarChart(percent, 21),
      `${percent.toFixed(1)}%`.padStart(5)
    ].join(' ');
  });

  const octokit = new Octokit({ auth: `token ${process.env.GH_TOKEN}` });
  const gist = await octokit.gists.get({ gist_id: process.env.GIST_ID });
  const filename = Object.keys(gist.data.files)[0];

  await octokit.gists.update({
    gist_id: process.env.GIST_ID,
    files: {
      [filename]: {
        filename: (morning + daytime) > (evening + night)
          ? "I'm an early 🐤"
          : "I'm a night 🦉",
        content: lines.join('\n'),
      },
    },
  });
})();
