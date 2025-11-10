import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readdir, unlink } from 'fs/promises';
import { join } from 'path';

const TEMPLATES_DIR = join(process.cwd(), 'public', 'templates');

// GET - List all templates
export async function GET() {
	try {
		const files = await readdir(TEMPLATES_DIR);
		const htmlFiles = files.filter(file => file.endsWith('.html'));
		
		const templates = await Promise.all(
			htmlFiles.map(async (file) => {
				const filePath = join(TEMPLATES_DIR, file);
				const fs = await import('fs/promises');
				const content = await fs.readFile(filePath, 'utf-8');
				
				// Extract title from HTML
				const titleMatch = content.match(/<title>(.*?)<\/title>/i);
				const title = titleMatch ? titleMatch[1] : file.replace('.html', '');
				
				return {
					id: file.replace('.html', ''),
					name: file.replace('.html', '').replace(/-/g, ' '),
					subject: title,
					message: content,
					filename: file,
				};
			})
		);
		
		return NextResponse.json({ templates });
	} catch (error) {
		console.error('Error reading templates:', error);
		return NextResponse.json({ templates: [] });
	}
}

// POST - Create a new template
export async function POST(request: NextRequest) {
	try {
		const { name, subject, message } = await request.json();
		
		// Create filename from name
		const filename = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') + '.html';
		
		const filePath = join(TEMPLATES_DIR, filename);
		
		// Ensure the message is valid HTML
		let htmlContent = message;
		if (!message.trim().startsWith('<!DOCTYPE') && !message.trim().startsWith('<html')) {
			// Wrap plain text in basic HTML structure
			htmlContent = `<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>${subject}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>
        <pre style="font-family: sans-serif; white-space: pre-wrap;">${message}</pre>
    </body>
</html>`;
		}
		
		await writeFile(filePath, htmlContent, 'utf-8');
		
		return NextResponse.json({ 
			success: true, 
			filename,
			message: 'Template saved successfully' 
		});
	} catch (error) {
		console.error('Error saving template:', error);
		return NextResponse.json(
			{ success: false, error: 'Failed to save template' },
			{ status: 500 }
		);
	}
}

// DELETE - Delete a template
export async function DELETE(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const filename = searchParams.get('filename');
		
		if (!filename) {
			return NextResponse.json(
				{ success: false, error: 'Filename is required' },
				{ status: 400 }
			);
		}
		
		const filePath = join(TEMPLATES_DIR, filename);
		await unlink(filePath);
		
		return NextResponse.json({ 
			success: true, 
			message: 'Template deleted successfully' 
		});
	} catch (error) {
		console.error('Error deleting template:', error);
		return NextResponse.json(
			{ success: false, error: 'Failed to delete template' },
			{ status: 500 }
		);
	}
}
