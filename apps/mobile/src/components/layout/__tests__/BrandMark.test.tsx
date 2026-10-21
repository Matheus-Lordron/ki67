import { render, screen } from '@testing-library/react-native';

import { BrandMark } from '@/components/layout/AuthShell';

describe('BrandMark', () => {
  it('usa só o nome Segmenta, sem o nome de um projeto', async () => {
    await render(<BrandMark />);
    expect(screen.getByText('Segmenta')).toBeTruthy();
    expect(screen.queryByText(/studio|ki-?67/i)).toBeNull();
  });

  it('pode mostrar só o símbolo, mantendo o nome para leitores de tela', async () => {
    await render(<BrandMark showName={false} />);
    expect(screen.queryByText('Segmenta')).toBeNull();
    expect(screen.getByLabelText('Segmenta')).toBeTruthy();
  });
});
