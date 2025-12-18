const pagination = require("hexo-pagination");

const paginationPath = hexo.config.pagination_dir.replace(/\/$/, "");
const postsPaths = ["/blog", "/posts"];

hexo.extend.generator.register("lists", (locals) => [
    ...postsPaths.flatMap((postsPath) =>
        pagination(postsPath, locals.posts.sort(hexo.config.index_generator.order_by), {
            perPage: hexo.config.per_page,
            format: `${paginationPath}/%d/`,
            layout: "posts",
        })
    ),
    ...pagination(
        hexo.config.tag_dir,
        locals.tags.sort(hexo.config.index_generator.order_by),
        {
            perPage: hexo.config.per_page,
            format: `${paginationPath}/%d/`,
            layout: "tags",
        }
    ),
    ...pagination(
        hexo.config.category_dir,
        locals.categories
            .find({ parent: undefined })
            .sort(hexo.config.index_generator.order_by),
        {
            perPage: hexo.config.per_page,
            format: `${paginationPath}/%d/`,
            layout: "categories",
        }
    ),
]);
