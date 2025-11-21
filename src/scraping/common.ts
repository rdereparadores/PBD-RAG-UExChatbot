
export const wait = async (milliseconds: number) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export const cleanContent = (content: string) => {
    return content
        .replace(/[\n\t]+/g, ' ')
        .trim();
}