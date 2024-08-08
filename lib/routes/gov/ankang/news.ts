import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';
import InvalidParameterError from '@/errors/types/invalid-parameter';

export const route: Route = {
    path: '/ankang/news/:uid',
    categories: ['government'],
    example: '/gov/ankang/news/news',
    parameters: { uid: '栏目名' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.ankang.gov.cn/Node-:uid.html'],
        },
    ],
    name: '政府新闻',
    maintainers: ['newton_miku'],
    handler,
    description: `| 新闻栏目名 |       :uid       |
  | :--------: | :--------------: |
  |  安康要闻  |       1466       |
  | 县市区新闻 |       866        |
  |  石泉新闻  |       916        |


  :::tip
  **热点专题**栏目包含**市本级专题**和**区县专题**

  **市本级专题**栏目包含**最新热点专题**和**往期专题**

  如需订阅完整的热点专题，仅需订阅 **热点专题**\`rdzt\` 一项即可。
  :::`,
};

async function handler(ctx) {
    const rootUrl = 'https://www.ankang.gov.cn/Node-';
    const uid = ctx.req.param('uid');
    let url = '';
    let title = '';
    let apiUrl = '';
    let items = [];
    switch (uid) {
        case 'akyw':
        case 'news':
        case '1466':
            url = `${rootUrl}1466.html`;
            title = '安康市政府 - 安康要闻';
            break;
        case '866':
        case 'district':
            url = `${rootUrl}866.html`;
            title = '安康市政府 - 县市区要闻';
            break;
        case '916':
        case 'shiquan':
            url = `${rootUrl}916.html`;
            title = '安康市政府 - 石泉县要闻';
            break;
        default:
            throw new InvalidParameterError('pattern not matched');
    }
    if (apiUrl) {
        const response = await got(apiUrl);
        const infoList = response.data.infolist.map((item) => ({
            title: item.title,
            link: item.link.startsWith('http') ? item.link : new URL(item.link, rootUrl).href,
            pubDate: timezone(parseDate(item.pubtime, 'YYYY-MM-DD HH:mm:ss'), 8),
        }));

        items = await Promise.all(
            infoList.map((item) =>
                // 获取全文
                cache.tryGet(item.link, async () => {
                    const response = await got(item.link);
                    const $ = load(response.data);
                    item.description = $('ucapcontent').html();

                    return item;
                })
            )
        );
    } else {
        const response = await got(url);

        const $ = load(response.data);
        items = $('ul.newlist li')
            .toArray()
            .map((item) => {
                item = $(item);
                const a = item.find('a');
                if (!a || a.length === 0) {
                    return null; // 如果 'a' 不存在，返回 null
                }
                const title = a.attr('title');
                // 如果 title 为空，则跳过
                if (!title) {
                    return null; // 返回 null 以过滤掉这个项目
                }
                return {
                    title: a.attr('title'),
                    link: new URL(a.attr('href'), rootUrl).href,
                    pubDate: timezone(parseDate(item.find('.date').text(), 'YYYY-MM-DD'), 8),
                };
            }).filter(item => item); // 过滤掉数组中的所有 null 值
    }

    return {
        title,
        link: url,
        item: items,
    };
}
