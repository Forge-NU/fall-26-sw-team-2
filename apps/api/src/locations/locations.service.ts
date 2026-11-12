import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Location as LocationRow } from '../generated/prisma/client';
import type {
  LocationProvider,
  LocationResponse,
  ResolveLocationRequest,
  ResolveLocationResponse,
} from 'shared-types';
import { CUSTOM_PROVIDER } from './custom-locations';
import { toLocationRating } from './location-ratings';

const PROVIDER = 'mapbox';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    userId: string,
    req: ResolveLocationRequest,
  ): Promise<ResolveLocationResponse> {
    if (req.kind === 'custom') {
      // Custom names are stored on the post, not as a locations row (DOC-1)
      return { kind: 'custom', name: req.name };
    }

    if (req.kind === 'pin') {
      // Always a new row: two people's "secret beach" aren't the same place,
      // and a pin belongs to the one post or story it goes on. Rows nobody
      // attaches are deleted by the cleanup job (custom-locations.ts).
      const row = await this.prisma.location.create({
        data: {
          provider: CUSTOM_PROVIDER,
          providerPlaceId: randomUUID(),
          name: req.name,
          latitude: req.latitude,
          longitude: req.longitude,
          createdBy: userId,
        },
      });
      return { kind: 'pin', location: toLocation(row) };
    }

    const where = {
      provider_providerPlaceId: {
        provider: PROVIDER,
        providerPlaceId: req.mapboxId,
      },
    };

    let row: LocationRow;
    try {
      // update: {} makes the first write win; later resolves of the same
      // place get the existing row back unchanged.
      row = await this.prisma.location.upsert({
        where,
        create: {
          provider: PROVIDER,
          providerPlaceId: req.mapboxId,
          name: req.name,
          latitude: req.latitude,
          longitude: req.longitude,
          address: req.address,
          city: req.city,
          region: req.region,
          countryCode: req.countryCode,
        },
        update: {},
      });
    } catch (e) {
      // Two concurrent first resolves of the same place: the loser hits the
      // unique constraint, and the winner's row is the one to return.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        row = await this.prisma.location.findUniqueOrThrow({ where });
      } else {
        throw e;
      }
    }

    return { kind: 'mapbox', location: toLocation(row) };
  }
}

// The one LocationResponse shape, used by resolve, posts and stories.
// created_by stays private.
export function toLocation(row: LocationRow): LocationResponse {
  return {
    id: row.id,
    provider: row.provider as LocationProvider,
    providerPlaceId: row.providerPlaceId,
    name: row.name,
    address: row.address,
    latitude: row.latitude.toNumber(),
    longitude: row.longitude.toNumber(),
    city: row.city,
    region: row.region,
    countryCode: row.countryCode,
    rating: toLocationRating(row),
  };
}
