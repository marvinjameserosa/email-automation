import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

const TEMPLATES_DIR = join(process.cwd(), 'public', 'templates');

function sanitizeId(id: string | string[] | undefined): string | null {
	if (!id) return null;
	const value = Array.isArray(id) ? id[0] : id;
	if (typeof value !== 'string') return null;
	const cleaned = value.replace(/[^A-Za-z0-9_-]/g, '').trim();
	return cleaned.length > 0 ? cleaned : null;
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
	const sanitizedId = sanitizeId(params.id);
	if (!sanitizedId) {
		return NextResponse.json(
			{ success: false, error: 'Invalid template identifier' },
			{ status: 400 }
		);
	}

	const filename = `${sanitizedId}.html`;
	const filePath = join(TEMPLATES_DIR, filename);

	try {
		const content = await readFile(filePath, 'utf-8');
		const titleMatch = content.match(/<title>(.*?)<\/title>/i);
		const name = sanitizedId.replace(/-/g, ' ');
		const subject = titleMatch ? titleMatch[1] : name;

		return NextResponse.json({
			template: {
				id: sanitizedId,
				name,
				subject,
				message: content,
				filename,
			},
		});
	} catch (error) {
		console.error(`Error reading template ${filename}:`, error);
		return NextResponse.json(
			{ success: false, error: 'Template not found' },
			{ status: 404 }
		);
	}
}

