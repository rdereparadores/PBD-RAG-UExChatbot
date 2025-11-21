
export interface ArticleSchema {
    uuid: string;
    title: string;
    url: string;
    content: string;
    metadata: {
        category: string,
        tags: string[],
        date: string // DIA/MES/AÑO
    }
}