import {useEffect, useState} from "react";
import Markdown from "react-markdown";

type Message = {
	role: 'llm' | 'user',
	message: string,
	metadata?: { score: number, text: string }[]
}

const Chat = () => {
	const [history, setHistory] = useState<Message[]>([])
	const [message, setMessage] = useState<string>('')
	const [streamedResponse, setStreamedResponse] = useState('')
	const [streaming, setStreaming] = useState(false)
	const [details, setDetails] = useState<{ score: number, text: string }[] | undefined>(undefined)

	const scrollChatToBottom = () => {
		const chat = document.getElementById('chatbox');
		chat!.scrollTop = chat!.scrollHeight;
	}

	useEffect(() => {
		if (!streaming && streamedResponse !== '') {
			fetch('http://localhost:8888/api/chat/documents', {
				method: 'GET'
			})
				.then(res => res.json())
				.then(res => {
					setHistory([...history, { role: 'llm', message: streamedResponse, metadata: res as { score: number, text: string }[] }]);
					setStreamedResponse('');
				})
		}
		scrollChatToBottom();
	}, [streaming]);

	const onSubmit = async (e: any) => {
		if (message === '') return;

		e.preventDefault();
		e.target.reset();
		setHistory([
			...history,
			{ role: 'user', message }
		]);

		const response = await fetch('http://localhost:8888/api/chat', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ message })
		});

		if (!response.body) return;

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let acc = '';

		setStreaming(true);
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			acc += chunk;
			setStreamedResponse(acc);
			scrollChatToBottom();
		}
		setStreaming(false);

	}

	return (
		<div className="flex flex-colh-screen w-screen items-center justify-center bg-base-100">
			<div className="flex flex-col w-3xl gap-5 items-center bg-base-300 p-5 min-h-screen">
				<h2 className="font-bold text-4xl">
					Chatbot de la Universidad de Extremadura
				</h2>
				<div id="chatbox" className="flex flex-col border-2 rounded-box grow w-full p-2 gap-2 max-h-[75dvh] overflow-auto">
					{
						history.map((msg, index) => (
							<div
								key={index}
								className={`rounded-box p-3 w-fit max-w-9/12 ${msg.role === 'user' ? 'self-end text-end bg-blue-400' : 'bg-gray-400'}`}
								onClick={() => {
									if (msg.role !== 'llm') return;
									setDetails(msg.metadata!);
									(document.getElementById('response-info-modal') as any).showModal();
								}}
							>
								<Markdown>{msg.message}</Markdown>
							</div>
						))
					}
					{
						streaming &&
						<div className="rounded-box p-3 w-fit bg-gray-400 max-w-9/12">
							<Markdown>{streamedResponse === '' ? '...' : streamedResponse}</Markdown>
						</div>
					}
				</div>
				<form onSubmit={onSubmit} className="flex gap-2 w-full">
					<input
						className="input grow"
						placeholder="Escribe tu mensaje aquí..."
						onChange={(e) => setMessage(e.target.value)}
					/>
					<button className="btn btn-primary">Enviar</button>
				</form>

				<dialog id="response-info-modal" className="modal">
					<div className="modal-box flex flex-col gap-5 overflow-auto">
						<p className="text-2xl font-bold">Documentos analizados</p>
						{
							details?.map(item => (
								<div key={item.score} className="flex flex-col gap-2 overflow-auto rounded-box bg-base-300 p-2">
									<p className="font-bold">Score</p>
									<p>{item.score}</p>
									<p className="font-bold">Texto</p>
									<p>{item.text}</p>
								</div>
							))
						}
					</div>
					<form method="dialog" className="modal-backdrop">
						<button>close</button>
					</form>
				</dialog>
			</div>
		</div>
	)
};

export default Chat;